module.exports = {
  extends: ['stylelint-config-recommended', 'stylelint-config-tailwindcss'],
  rules: {
    'color-function-notation': null
  },
  ignoreFiles: ['**/dist/**', '**/node_modules/**']
};
