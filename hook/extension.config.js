
 function ignoreSharp() {
  return {
    name: 'ignore-sharp',
    resolveId(importee) {
      if (importee.startsWith('nodemailer') || importee.startsWith('axios')) {
        return { id: importee, external: true };
      }

      return null;
    },
  };
}
module.exports = {
  plugins: [ignoreSharp()]
}
