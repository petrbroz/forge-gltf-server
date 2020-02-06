const { exec } = require('child_process');

module.exports = (workingDir, inputFile, outputFile) => new Promise(function (resolve, reject) {
    const cmd = `docker run --rm -v $(PWD):/usr/app leon/usd-from-gltf:latest ${inputFile} ${outputFile}`;
    const options = { cwd: workingDir };
    exec(cmd, options, (error, stdout, stderr) => {
        if (error) {
            reject(error.message);
        } else {
            resolve({ stdout, stderr });
        }
    });
});
