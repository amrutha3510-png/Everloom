import dns from "node:dns";
import mongoose from "mongoose";

// Set reliable DNS servers if Node defaults to localhost resolver 127.0.0.1 on Windows
const currentServers = dns.getServers();
if (currentServers.length === 0 || (currentServers.length === 1 && currentServers[0] === "127.0.0.1")) {
    const customServers = process.env.DNS_SERVERS
        ? process.env.DNS_SERVERS.split(",").map(s => s.trim())
        : ["8.8.8.8", "1.1.1.1"];
    dns.setServers(customServers);
}

const connectDB = async () => {
    try {

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB Connected");

    } catch (error) {

        console.error("Database Connection Error:", error.message);

        process.exit(1);

    }
};

export default connectDB;