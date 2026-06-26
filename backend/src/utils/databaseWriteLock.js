let writeQueue = Promise.resolve();

const acquireDatabaseWriteLock = async () => {
  let release;
  const previous = writeQueue;
  writeQueue = new Promise((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  return release;
};

module.exports = { acquireDatabaseWriteLock };
