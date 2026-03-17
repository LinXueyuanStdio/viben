import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      // Disable set-state-in-effect for common SSR hydration patterns
      // e.g., setMounted(true) in useEffect for client-only rendering
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
