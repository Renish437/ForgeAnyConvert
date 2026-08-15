const { spawn } = require("child_process");

/**
 * Run an external CLI tool and resolve/reject based on its exit code.
 * Captures stdout/stderr so failures come back with a useful message
 * instead of a bare "exit code 1".
 */
function run(command, args, { timeoutMs = 5 * 60 * 1000, cwd, env } = {}) {
  return new Promise((resolvePromise, reject) => {
    if (!command) {
      return reject(new Error("Required command-line tool was not found on this system."));
    }

    const child = spawn(command, args, { cwd, env: env ? { ...process.env, ...env } : process.env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to launch "${command}": ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(new Error(`"${command}" timed out after ${timeoutMs}ms`));
      }
      if (code !== 0) {
        return reject(
          new Error(`"${command} ${args.join(" ")}" exited with code ${code}: ${stderr || stdout}`)
        );
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

module.exports = { run };
