import { Router } from "express";
import { AuthController } from "../controllers/auth";
import { authenticateToken, optionalAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../controllers/auth";

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new system user
 * @access Public
 */
router.post(
  "/register",
  validateRequest(registerSchema),
  AuthController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login user and return JWT tokens
 * @access Public
 */
router.post("/login", validateRequest(loginSchema), AuthController.login);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post(
  "/refresh",
  validateRequest(refreshTokenSchema),
  AuthController.refresh
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user and invalidate refresh token
 * @access Private
 */
router.post("/logout", optionalAuth, AuthController.logout);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get("/me", authenticateToken, AuthController.me);

/**
 * @route POST /api/auth/forgot-password
 * @desc Send password reset email
 * @access Public
 */
router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using token
 * @access Public
 */
router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword
);

export default router;
