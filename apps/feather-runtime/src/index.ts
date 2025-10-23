import { FeatherRuntime } from './FeatherRuntime';

async function main() {
  const runtime = new FeatherRuntime();
  const port = parseInt(process.env.PORT || '3001');

  try {
    await runtime.start(port);
    console.log(`🚀 Feather Runtime started on port ${port}`);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Feather Runtime...');
      await runtime.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down Feather Runtime...');
      await runtime.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start Feather Runtime:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { FeatherRuntime };
