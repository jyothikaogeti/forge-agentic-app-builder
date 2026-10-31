export const clerkAppearance = {
  variables: {
    colorPrimary: "#A855F7",
    colorBackground: "#0D0A14",
    colorText: "#FFFFFF",
    colorTextSecondary: "rgba(255, 255, 255, 0.55)",
    colorInputBackground: "rgba(255, 255, 255, 0.045)",
    colorInputText: "#FFFFFF",
    colorDanger: "#F87171",
    borderRadius: "0.75rem",
  },

  elements: {
    card: `
      bg-white/[0.035]
      border border-white/[0.09]
      shadow-2xl
      shadow-purple-500/10
      backdrop-blur-2xl
    `,
    headerTitle: "text-white font-serif",
    headerSubtitle: "text-white/50",
    formFieldLabel: "text-white/80",
    formFieldInput: `
      bg-white/5
      border-white/10
      text-white
      placeholder:text-white/30
      focus:border-purple-400/60
      focus:ring-purple-400/20
    `,
    formButtonPrimary: `
      bg-linear-to-br
      from-purple-500
      via-purple-600
      to-purple-800
      hover:from-purple-400
      hover:via-purple-500
      hover:to-purple-700
      text-white
      shadow-lg
      shadow-purple-950/40
      transition-all
    `,
    socialButtonsBlockButton: `
      bg-white/5
      border-white/10
      text-white
      hover:bg-white/10
    `,
    socialButtonsBlockButtonText: "text-white/80",
    dividerLine: "bg-white/10",
    dividerText: "text-white/30",
    footerActionText: "text-white/40",
    footerActionLink: "text-purple-400 hover:text-purple-300",
    identityPreview: "bg-white/5 border-white/10",
    identityPreviewText: "text-white/80",
    identityPreviewEditButton: "text-purple-400 hover:text-purple-300",
    formFieldSuccessText: "text-purple-400",
    formFieldErrorText: "text-red-400",
    alert: "bg-red-500/10 border border-red-500/20 text-red-300",
  },
};
