import app from './app';
import { PORT } from './config';
import { registerBuiltinTools } from './services/agent/tools/builtin';

// Register tools
registerBuiltinTools();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
