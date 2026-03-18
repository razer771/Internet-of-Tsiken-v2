export const COLORS = {
  // Text Colors
  textPrimary: "#1e293b", // Dark slate - main titles
  textSecondary: "#475569", // Medium gray-blue - main messages
  textTertiary: "#64748b", // Light gray-blue - helper text
  textButton: "#475569", // Button text color

  // Background Colors
  backgroundModal: "#fff", // White modal background
  backgroundOverlay: "rgba(0, 0, 0, 0.5)", // Semi-transparent overlay

  // Button Colors
  buttonNeutral: "#e5e7eb", // Light gray - cancel/later button
  buttonGreen: "#16a34a", // Green - positive action (harvest now)
  buttonRed: "#dc2626", // Red - confirm destructive action
  buttonText: "#fff", // White text on colored buttons

  // Alert Colors
  alertRed: "#ef4444", // Red for warnings/destructive
  alertSuccess: "#10b981", // Green for success
};

// ==================== TYPOGRAPHY ====================
export const TYPOGRAPHY = {
  iconLarge: {
    fontSize: 64,
  },
  iconMedium: {
    fontSize: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  message: {
    fontSize: 16,
    fontWeight: "500",
  },
  messageSmall: {
    fontSize: 15,
    fontWeight: "500",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  warningText: {
    fontSize: 14,
    fontWeight: "400",
  },
};

// ==================== SHADOW & ELEVATION ====================
export const SHADOWS = {
  modal: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12, // Android
  },
  success: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
};

// ==================== MODAL CONTAINERS ====================
export const MODAL_STYLES = {
  overlay: {
    flex: 1,
    backgroundColor: COLORS.backgroundOverlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.backgroundModal,
    borderRadius: 20,
    padding: 28,
    width: "85%",
    alignItems: "center",
    ...SHADOWS.modal,
  },
  successModalCard: {
    width: "85%",
    maxWidth: 320,
    backgroundColor: COLORS.backgroundModal,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    ...SHADOWS.success,
  },
};

// ==================== ICON STYLES ====================
export const ICON_STYLES = {
  harvestIconLarge: {
    fontSize: 64,
    marginBottom: 16,
  },
  confirmIconText: {
    fontSize: 56,
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 48,
    color: COLORS.alertSuccess,
    marginBottom: 12,
    fontWeight: "bold",
  },
};

// ==================== TEXT STYLES ====================
export const TEXT_STYLES = {
  // Titles
  titleLarge: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },

  // Messages
  messageLarge: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
  },
  successMessage: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },

  // Question/Warning Text
  questionText: {
    fontSize: 15,
    color: COLORS.textTertiary,
    marginBottom: 24,
    fontStyle: "italic",
  },
  warningText: {
    fontSize: 14,
    color: COLORS.alertRed,
    marginBottom: 24,
    textAlign: "center",
  },
};

// ==================== BUTTON STYLES ====================
export const BUTTON_STYLES = {
  // Container
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 8,
  },

  // Cancel/Later Button
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.buttonNeutral,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.buttonNeutral,
  },
  cancelButtonText: {
    color: COLORS.textButton,
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
  },

  // Positive/Green Button (Harvest Now)
  positiveButton: {
    flex: 1,
    backgroundColor: COLORS.buttonGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  positiveButtonText: {
    color: COLORS.buttonText,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },

  // Negative/Red Button (Confirm Destructive)
  negativeButton: {
    flex: 1,
    backgroundColor: COLORS.buttonRed,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  negativeButtonText: {
    color: COLORS.buttonText,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
};

// ==================== COMPLETE STYLESHEET EXPORT ====================
/**
 * Use this for a complete StyleSheet object if needed
 * Import and spread in your StyleSheet.create()
 */
export const STYLESHEET_OBJECT = {
  // Overlay & Containers
  overlay: MODAL_STYLES.overlay,
  harvestModalCard: MODAL_STYLES.modalCard,
  confirmModalCard: MODAL_STYLES.modalCard,
  successModalCard: MODAL_STYLES.successModalCard,

  // Icons
  harvestIconLarge: ICON_STYLES.harvestIconLarge,
  confirmIconText: ICON_STYLES.confirmIconText,
  successIcon: ICON_STYLES.successIcon,

  // Titles
  harvestTitleLarge: TEXT_STYLES.titleLarge,
  confirmTitleText: TEXT_STYLES.titleLarge,
  successTitle: TEXT_STYLES.successTitle,

  // Messages
  harvestMessageLarge: TEXT_STYLES.messageLarge,
  confirmMessageText: TEXT_STYLES.messageLarge,
  successMessage: TEXT_STYLES.successMessage,

  // Question/Warning
  harvestQuestionText: TEXT_STYLES.questionText,
  confirmWarningText: TEXT_STYLES.warningText,

  // Buttons
  harvestActionButtons: BUTTON_STYLES.actionButtons,
  confirmActionButtons: BUTTON_STYLES.actionButtons,

  harvestLaterBtn: BUTTON_STYLES.cancelButton,
  harvestLaterBtnText: BUTTON_STYLES.cancelButtonText,

  harvestNowBtn: BUTTON_STYLES.positiveButton,
  harvestNowBtnText: BUTTON_STYLES.positiveButtonText,

  confirmCancelButton: BUTTON_STYLES.cancelButton,
  confirmCancelButtonText: BUTTON_STYLES.cancelButtonText,

  confirmProceedButton: BUTTON_STYLES.negativeButton,
  confirmProceedButtonText: BUTTON_STYLES.negativeButtonText,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get modal styles merged with shadow
 * Useful for custom modal implementations
 * @returns {Object} Complete modal card style
 */
export const getModalCardStyle = () => ({
  ...MODAL_STYLES.modalCard,
});

/**
 * Get button style (positive or negative)
 * @param {'positive' | 'negative' | 'neutral'} type - Button type
 * @returns {Object} Button style object
 */
export const getButtonStyle = (type) => {
  switch (type) {
    case "positive":
      return BUTTON_STYLES.positiveButton;
    case "negative":
      return BUTTON_STYLES.negativeButton;
    case "neutral":
    default:
      return BUTTON_STYLES.cancelButton;
  }
};

/**
 * Get button text style (positive or negative)
 * @param {'positive' | 'negative' | 'neutral'} type - Button type
 * @returns {Object} Button text style object
 */
export const getButtonTextStyle = (type) => {
  switch (type) {
    case "positive":
      return BUTTON_STYLES.positiveButtonText;
    case "negative":
      return BUTTON_STYLES.negativeButtonText;
    case "neutral":
    default:
      return BUTTON_STYLES.cancelButtonText;
  }
};
