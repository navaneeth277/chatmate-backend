import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware to authenticate and attach user info to request
const authenticate = async (req, res, next) => {
  const token = req.header('Authorization'); // Token is directly passed in the Authorization header without 'Bearer'

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find the user by id from the decoded token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user information to the request object
    req.user = {
      id: user._id,
      name: user.name,
    };
 //console.log("Authenticated user:", req.user);
    next(); // Call the next middleware/route handler
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authenticate;
