/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/
'use strict';

const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('./package.json'));

if (process.argv.includes('enable')) {
    console.log('enabling npm install flag');
    packageJson.runNpmInstall = true;

} else if (process.argv.includes('check')) {
    console.log('checking npm install flag is set to true');
    if (!packageJson.runNpmInstall) {
        throw new Error('runNpmInstall flag should be true when checked in');
    }

} else {
    console.log('disabling npm install flag');
    packageJson.runNpmInstall = false;
}

const packageJsonString = JSON.stringify(packageJson, null, 4);

fs.writeFileSync('./package.json', packageJsonString, 'utf8');

console.log('finished toggling npm install flag');
