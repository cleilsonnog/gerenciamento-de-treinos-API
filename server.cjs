// Wrapper CJS for Passenger/LiteSpeed compatibility
// Passenger uses require() which doesn't support ESM with top-level await
async function start() {
  await import("./dist/index.js");
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
