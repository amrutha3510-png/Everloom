import Product from '../../models/productModel.js';
import mongoose from 'mongoose';

export const getInventory = async (query = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const pipeline = [];

  // Match only active/non-deleted products
  pipeline.push({ $match: { isDeleted: false } });

  // Unwind variants to treat each variant as a row in inventory
  pipeline.push({ $unwind: "$variants" });

  // Lookup Category to get name
  pipeline.push({
    $lookup: {
      from: "categories",
      localField: "category",
      foreignField: "_id",
      as: "categoryDoc"
    }
  });
  pipeline.push({ $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } });

  // Lookup Subcategory to get name
  pipeline.push({
    $lookup: {
      from: "subcategories",
      localField: "subcategory",
      foreignField: "_id",
      as: "subcategoryDoc"
    }
  });
  pipeline.push({ $unwind: { path: "$subcategoryDoc", preserveNullAndEmptyArrays: true } });

  // Prepare match filters
  const matchFilter = {};

  // Category filter
  if (query.category && query.category !== 'All Categories') {
    try {
      matchFilter["categoryDoc._id"] = new mongoose.Types.ObjectId(query.category);
    } catch (e) {
      // Ignore invalid ObjectId
    }
  }

  // Stock status filter
  if (query.stockStatus && query.stockStatus !== 'All') {
    if (query.stockStatus === 'Out of Stock') {
      matchFilter["variants.stock"] = 0;
    } else if (query.stockStatus === 'Low Stock') {
      matchFilter["variants.stock"] = { $gt: 0, $lte: 5 };
    } else if (query.stockStatus === 'In Stock') {
      matchFilter["variants.stock"] = { $gt: 5 };
    }
  }

  // Match filters if any
  if (Object.keys(matchFilter).length > 0) {
    pipeline.push({ $match: matchFilter });
  }

  // Search input matching name, category.name, variant.size, variant.color
  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    pipeline.push({
      $match: {
        $or: [
          { name: searchRegex },
          { "categoryDoc.name": searchRegex },
          { "variants.size": searchRegex },
          { "variants.color": searchRegex }
        ]
      }
    });
  }

  // Sorting
  let sortStage = { createdAt: -1 };
  if (query.sort === 'stock-low') {
    sortStage = { "variants.stock": 1 };
  } else if (query.sort === 'stock-high') {
    sortStage = { "variants.stock": -1 };
  }
  pipeline.push({ $sort: sortStage });

  // Count pipeline to calculate pagination totals
  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await Product.aggregate(countPipeline);
  const totalEntries = countResult.length > 0 ? countResult[0].total : 0;

  // Pagination skip and limit
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // Project the final structure
  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      colorOptions: 1,
      variant: "$variants",
      category: "$categoryDoc",
      subcategory: "$subcategoryDoc",
      createdAt: 1
    }
  });

  const variantsList = await Product.aggregate(pipeline);

  // Map low-stock status onto the result
  variantsList.forEach(item => {
    // Find matching image from colorOptions
    const colorOpt = item.colorOptions?.find(co => co.name.toLowerCase() === item.variant.color.toLowerCase());
    item.image = (colorOpt && colorOpt.images && colorOpt.images[0]) || (item.colorOptions && item.colorOptions[0] && item.colorOptions[0].images && item.colorOptions[0].images[0]) || '';
    
    // Assign status
    if (item.variant.stock === 0) {
      item.stockStatus = 'Out of Stock';
    } else if (item.variant.stock <= 5) {
      item.stockStatus = 'Low Stock';
    } else {
      item.stockStatus = 'In Stock';
    }
  });

  // Calculate global stats for variants
  const statsPipeline = [
    { $match: { isDeleted: false } },
    { $unwind: "$variants" },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        inStock: {
          $sum: { $cond: [{ $gt: ["$variants.stock", 5] }, 1, 0] }
        },
        lowStock: {
          $sum: { $cond: [{ $and: [{ $gt: ["$variants.stock", 0] }, { $lte: ["$variants.stock", 5] }] }, 1, 0] }
        },
        outOfStock: {
          $sum: { $cond: [{ $eq: ["$variants.stock", 0] }, 1, 0] }
        }
      }
    }
  ];
  const statsResult = await Product.aggregate(statsPipeline);
  const stats = statsResult.length > 0 ? statsResult[0] : { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 };

  return {
    variants: variantsList,
    totalPages: Math.ceil(totalEntries / limit) || 1,
    currentPage: page,
    totalEntries,
    sortOption: query.sort || 'newest',
    stats
  };
};

export const updateVariantStock = async (productId, variantId, newStock) => {
  const stockNum = parseFloat(newStock);
  if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
    throw new Error('Stock must be a valid non-negative integer.');
  }

  const product = await Product.findOneAndUpdate(
    { _id: productId, "variants._id": variantId },
    { $set: { "variants.$.stock": stockNum } },
    { new: true }
  );

  if (!product) {
    throw new Error('Product or variant not found.');
  }

  return product;
};
