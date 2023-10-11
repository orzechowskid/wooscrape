/** @type {import("eslint").Linter.FlatConfig[]} */
export default [{
  env: {
    "node": true
  },
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    
  },
  rules: {
    "no-undef": "error",
    "semi": "error"
  }
}];
