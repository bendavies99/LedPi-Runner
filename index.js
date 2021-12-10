const path = require('path');
const fs = require('fs');
const exec = require('child_process').exec;
const runConfig = require('./runConfig.json');
const { kill } = require('process');


//Get the directory from the cli argument
const dir = runConfig.location;
const javaBin = runConfig.javaHome;

console.log(`Loading Data for LedPi Project inside: ${dir}`);

const dirLibPath = path.join(__dirname, dir, "lib");

const jars = fs.readdirSync(dirLibPath);

const classPath = jars.map(j => path.join(dirLibPath, j)).join(";");

const runCommand = async (cmd, ...params) => await (new Promise((res, rej) => {
  const script = exec(`"${cmd}" ${params.join(" ")}`);
  script.stdout.on('data', d => res(d.replace(/\n/gm, '').replace(/\r\n/gm, '').replace(/\n\r/gm, '')));
  script.stderr.on('data', d => res(d.replace(/\n/gm, '').replace(/\r\n/gm, '').replace(/\n\r/gm, '')));
  script.on('exit', c => c != 0 ? rej(c) : res(c));
}));

(async () => {

  const jh = (javaBin || ((process.env.JAVA_HOME || (await runCommand('which', 'java')) || ''))).replace(/\/c\//, 'C:/');
  let javaCmd = 'java';
  if (jh) {
    javaCmd = path.join(jh);
  }
  const jv = (await runCommand(javaCmd.replace(/\\/g, "\\\\"), '-version'))
  console.log(`Java Command: ${javaCmd}`);
  console.log(`Java Version: ${jv}`);
  const jvRegexed = jv.split(/\n/gm)[0].replace(/[^"]+"(.+)".*/g, "$1").trim();
  console.log(`Java Version Regexed: ${jvRegexed}`);
  if (/11\.+/.test(jvRegexed)) {
    console.log("Correct J Version");
    const systemArgs = ['-Dlp.trace=true', '-Dlp.debugDisplay=true'];
    const jArgs = [`-classpath ${classPath}`, ...systemArgs, 'net.bdavies.app.Application'];
    startServer(24532, javaCmd, jArgs);
  } else {
    console.error("Cannot run because J version needs to be >= 11");
  }
})();

const startServer = (stopPort, cmd, args) => {
  const kill = require('tree-kill');
  // console.log(`"${cmd}" ${args}`);
  const serverProcess = require('child_process').spawn(`"${cmd}"`, args, { shell: true });

  serverProcess.stdout.on('data', d => {
    console.log(String(d));
  });
  serverProcess.stderr.on('data', d => {
    console.error(String(d));
  });
  serverProcess.on('error', err => {
    console.log(err);
  });
  serverProcess.on('exit', code => {
      console.log('Light server stopped with code: ' + code);
      socketItem.close();
  });
  if (serverProcess.pid) {
    console.log("Server Started: " + serverProcess.pid);
    const dgram = require('dgram');
    const socket = dgram.createSocket('udp4');
    process.on('SIGINT', () => {
      console.log("Handling Ctrl+C\n Stopping light server");
      kill(serverProcess.pid, 'SIGINT', err => {
        console.log("Stopped the Light Server");
        socketItem.close();
        if (err) {
          console.error("Something went wrong", err);
        }
      })
    });
    socket.on('message', msg => {
      if (msg.toString().toLowerCase() === 'doit') {
        kill(serverProcess.pid, 'SIGINT', err => {
          console.log("Stopped the Light Server");
          socketItem.close();
          if (err) {
            console.error("Something went wrong", err);
          }
        })
      }
    });
    console.log("Listen for stop command on port: " + stopPort);
    var socketItem = socket.bind(stopPort, '0.0.0.0');
  }

}
