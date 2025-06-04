import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import jwsMiddeware from "../middleware/jwsMiddelware.js";

const router = express.Router();

// User signup
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  //console.log(req.body)

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = new User({ name, email, password: hashedPassword });

  try {
    await user.save();

    // Create JWT token after successful user creation
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({
      message: "User created successfully",
      token, // Send the JWT token
    });
  } catch (err) {
    res.status(500).json({ message: "User creation failed" });
  }
});

// User login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
//console.log(req.body)
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  // Create JWT token after successful login
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.json({ token }); // Send the JWT token
});
router.get("/profile", jwsMiddeware, (req, res) => {
  const { id, name } = req.user;
  res.json({ message: "User profile", id, name });
});

export default router;
