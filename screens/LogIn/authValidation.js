/**
 * Authentication Validation Utilities
 * Handles all password and email validation rules
 */

export const PASSWORD_RULES = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 20,
  REQUIRES_UPPERCASE: true,
  REQUIRES_LOWERCASE: true,
  REQUIRES_NUMBER: true,
  REQUIRES_SPECIAL_CHAR: true,
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || email.trim() === "") {
    return { isValid: false, error: "Email is required" };
  }

  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Please enter a valid email address" };
  }

  return { isValid: true, error: null };
};

/**
 * Validate password against all rules
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, errors: array }
 */
export const validatePassword = (password) => {
  const errors = [];

  if (!password || password.trim() === "") {
    return { isValid: false, errors: ["Password is required"] };
  }

  if (password.length < PASSWORD_RULES.MIN_LENGTH) {
    errors.push(
      `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters`
    );
  }

  if (password.length > PASSWORD_RULES.MAX_LENGTH) {
    errors.push(
      `Password must not exceed ${PASSWORD_RULES.MAX_LENGTH} characters`
    );
  }

  if (PASSWORD_RULES.REQUIRES_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (PASSWORD_RULES.REQUIRES_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (PASSWORD_RULES.REQUIRES_NUMBER && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (
    PASSWORD_RULES.REQUIRES_SPECIAL_CHAR &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ) {
    errors.push(
      "Password must contain at least one special character (!@#$%^&* etc.)"
    );
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

/**
 * Validate passwords match
 * @param {string} password - Password
 * @param {string} confirmPassword - Confirm password
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validatePasswordMatch = (password, confirmPassword) => {
  if (password !== confirmPassword) {
    return { isValid: false, error: "Passwords do not match" };
  }
  return { isValid: true, error: null };
};

/**
 * Validate OTP format (6 digits)
 * @param {string} otp - OTP to validate
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validateOTP = (otp) => {
  const otpRegex = /^\d{6}$/;

  if (!otp || otp.trim() === "") {
    return { isValid: false, error: "OTP is required" };
  }

  if (!otpRegex.test(otp)) {
    return { isValid: false, error: "OTP must be 6 digits" };
  }

  return { isValid: true, error: null };
};
