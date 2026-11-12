/**
 * Módulo de validación para VetSalud
 * Previene valores nulos, vacíos, 0, -0 y números negativos en todas las operaciones del sistema.
 */

const isNegativeZero = (val) => {
    return Object.is(val, -0) || Object.is(Number(val), -0);
};

const isPositiveNumber = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return false;
    if (isNegativeZero(num)) return false;
    return num > 0;
};

const isNonNegativeNumber = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return false;
    if (isNegativeZero(num)) return false;
    return num >= 0;
};

const isPositiveInteger = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (isNaN(num) || !Number.isInteger(num)) return false;
    if (isNegativeZero(num)) return false;
    return num > 0;
};

const isNonNegativeInteger = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (isNaN(num) || !Number.isInteger(num)) return false;
    if (isNegativeZero(num)) return false;
    return num >= 0;
};

const isNonEmptyString = (val) => {
    return typeof val === 'string' && val.trim().length > 0;
};

const isValidDate = (val) => {
    if (!val) return false;
    const date = new Date(val);
    return !isNaN(date.getTime());
};

const isValidEmail = (val) => {
    if (!isNonEmptyString(val)) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val.trim());
};

module.exports = {
    isNegativeZero,
    isPositiveNumber,
    isNonNegativeNumber,
    isPositiveInteger,
    isNonNegativeInteger,
    isNonEmptyString,
    isValidDate,
    isValidEmail
};

