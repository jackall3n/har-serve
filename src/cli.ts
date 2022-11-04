import { program } from "commander";

// Commands
import serve from "./serve";

program
  .name("har-serve")
  .description("Server a HAR")
  .argument("<har>", "A HAR file")
  .option("-e, --exclude [pattern]", "Patterns to exclude", (value) =>
    value.split(",")
  )
  .action(serve);

program.parse(process.argv);
