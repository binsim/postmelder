/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
};

process.env = Object.assign(process.env, {
	NODE_ENV: 'test',
});
