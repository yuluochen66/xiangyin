/**
 * ESLint 扁平配置（ESLint 9+）。
 *
 * 分工：
 * - ESLint 负责「正确性与规范」类问题（未使用变量、可疑写法、Vue 语义规则）；
 * - Prettier 负责「格式」（缩进、引号、换行、分号），因此最后用
 *   eslint-config-prettier 关掉所有与 Prettier 冲突的格式化规则，避免两者互相打架。
 *
 * 运行：
 *   pnpm lint         仅检查
 *   pnpm lint:fix     自动修复可修复项
 *   pnpm format       用 Prettier 格式化
 */
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jsdoc from 'eslint-plugin-jsdoc'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-single/**',
      'node_modules/**',
      '.pnpm-store/**',
      '.taste-skill/**',
      '.impeccable/**',
      '.dsh/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        // .vue 里 <script setup lang="ts"> 交给 TypeScript 解析器
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },

  {
    files: ['**/*.{ts,vue,mjs,js}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // 视图组件以 Flow1UploadView 这类名字注册，单词名在此项目属正常
      'vue/multi-word-component-names': 'off',
      // 类型导入一律使用 import type（tsconfig 开启了 verbatimModuleSyntax）
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      // 禁止显式 any：接口边界的不确定性应通过 unknown + 收窄表达
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // TS 已负责标识符解析（含 lib.dom 里的类型名如 ScrollBehavior），
      // 再开 no-undef 只会对类型位置误报，这也是 typescript-eslint 的官方建议。
      'no-undef': 'off',
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  {
    /**
     * JSDoc 完整性。
     *
     * 作用域刻意收窄成「**已经有文档块的函数**」：只要求已有的文档把参数与返回值
     * 交代完整，不强制每个函数都必须写文档（那是 require-jsdoc 的事，本项目不开）。
     * 这样既能保证公开 API 的文档不缺项，又不会给内部小函数制造噪声。
     *
     * 类型不在 JSDoc 里重复声明——类型由 TypeScript 承担，写两遍必然出现不一致。
     */
    files: ['src/**/*.{ts,vue}'],
    plugins: { jsdoc },
    settings: {
      jsdoc: { mode: 'typescript' },
    },
    rules: {
      'jsdoc/require-param': ['error', { enableFixer: true, checkDestructured: false }],
      'jsdoc/require-returns': ['error', { enableFixer: true }],
      'jsdoc/check-param-names': ['error', { checkDestructured: false }],
      // 描述无法自动生成，必须由人写：设为 error，避免「标签补上了、描述空着」混进主干
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
    },
  },

  {
    // 生成器脚本是命令行工具，允许打印进度
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },

  prettier,
)
