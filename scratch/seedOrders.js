import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import Order from '../src/models/orderModel.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const seedOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Count existing orders
    const orderCount = await Order.countDocuments();
    console.log(`Current order count: ${orderCount}`);

    if (orderCount > 0) {
      console.log('Orders already exist. Seeding skipped.');
      process.exit(0);
    }

    // Find users
    const users = await User.find();
    console.log(`Found ${users.length} users.`);

    // Find products
    const products = await Product.find({ isDeleted: false });
    console.log(`Found ${products.length} products.`);

    if (users.length === 0) {
      console.log('No users found. Creating a mock user...');
      const mockUser = await User.create({
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        isVerified: true,
        role: 'user',
        phone: '9876543210'
      });
      users.push(mockUser);
    }

    if (products.length === 0) {
      console.log('No products found. Cannot seed orders without products. Please add some products first.');
      process.exit(1);
    }

    // Seed orders
    const statuses = ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
    const mockAddresses = [
      {
        fullName: 'John Doe',
        phone: '9876543210',
        addressLine1: 'Flat 405, Prestige Apartments',
        addressLine2: 'Outer Ring Road',
        city: 'Bangalore',
        locality: 'Marathahalli',
        state: 'Karnataka',
        pincode: '560037',
        country: 'India'
      },
      {
        fullName: 'Jane Smith',
        phone: '9123456789',
        addressLine1: 'Plot No. 12, Green Glen Layout',
        addressLine2: 'Near Bellandur Lake',
        city: 'Bangalore',
        locality: 'Bellandur',
        state: 'Karnataka',
        pincode: '560103',
        country: 'India'
      }
    ];

    const ordersToCreate = [];

    // Create 15 mock orders over the last 15 days
    for (let i = 0; i < 15; i++) {
      const user = users[i % users.length];
      const product = products[i % products.length];
      
      // Get a random variant
      const variant = product.variants[0] || { size: 'M', color: 'Black', price: 1299, stock: 10 };
      const quantity = Math.floor(Math.random() * 2) + 1; // 1 or 2
      const price = variant.price;
      const totalAmount = price * quantity;
      
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - i); // Go back i days

      const order = {
        user: user._id,
        items: [
          {
            product: product._id,
            variant: {
              size: variant.size,
              color: variant.color
            },
            quantity,
            price
          }
        ],
        totalAmount,
        shippingAddress: mockAddresses[i % mockAddresses.length],
        status: statuses[i % statuses.length],
        paymentMethod: i % 2 === 0 ? 'COD' : 'Online',
        createdAt: orderDate,
        updatedAt: orderDate
      };

      ordersToCreate.push(order);
    }

    await Order.insertMany(ordersToCreate);
    console.log('Successfully seeded 15 mock orders.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedOrders();
