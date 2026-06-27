/**
 * @typedef {Object} Session
 * @property {string} token
 */

/**
 * @typedef {Object} FileUploadConfig
 * @property {boolean} [enabled]
 * @property {string[]} [acceptedTypes]
 * @property {string} [buttonLabel]
 * @property {string} [endpoint]
 * @property {string} [reportLabel]
 */

/**
 * @typedef {Object} AgentFeatures
 * @property {FileUploadConfig} [fileUpload]
 */

/**
 * @typedef {Object} AgentMessages
 * @property {string} [coldStart]
 * @property {string} [error]
 * @property {string} [loading]
 * @property {string} [noProxy]
 */

/**
 * @typedef {Object} Agent
 * @property {string} id
 * @property {string} name
 * @property {string} [icon]
 * @property {string} [description]
 * @property {string} [mode]
 * @property {AgentFeatures} [features]
 * @property {AgentMessages} [messages]
 */

/**
 * @typedef {Object} ModelConfig
 * @property {string} display_name
 * @property {string[]|null} effort_levels
 * @property {string} thinking_type
 */

/**
 * @typedef {Object} MessageMeta
 * @property {string|null} display_name
 * @property {string|null} effort
 * @property {boolean} thinking
 * @property {boolean} fallback
 */