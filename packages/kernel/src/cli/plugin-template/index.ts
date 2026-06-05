// Plugin scaffold template re-exports.
// All generate* functions accept TemplateParams and return file content as a string.
// Used by cmdPluginCreate to write the complete plugin project structure.
export type { TemplateParams } from './package-json.js'
export { generatePackageJson } from './package-json.js'
export { generateTsconfig } from './tsconfig.js'
export { generateGitignore, generateNpmignore, generateEditorconfig } from './dotfiles.js'
export { generateReadme } from './readme.js'
export { generatePluginSource } from './plugin-source.js'
export { generatePluginTest } from './plugin-test.js'
export { generateClaudeMd } from './claude-md.js'
export { generatePluginGuide } from './plugin-guide.js'
