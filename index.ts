import Alfred from './alfred';

const main = async () => {
  const alfred = new Alfred();
  await alfred.initialize();

  // start the CLI app
  alfred.alfred(process.argv.slice(2));
};

main();
