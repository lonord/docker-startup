#!/usr/bin/env node

import * as program from 'commander'
import { init, prepare, startup } from './'

// tslint:disable-next-line:no-var-requires
const pkg = require('../package.json')

let handled = false

program
	.version(pkg.version, '-v, --version')
	.description(pkg.description)

program
	.command('init')
	.description('generate startup.yml file')
	.alias('i')
	.option('-c, --config-file <name>', 'specific another config file name to generate')
	.action((cmd) => {
		handled = true
		const configFile = cmd.configFile
		init({
			configFile,
			cwd: process.cwd()
		}).then((f) => console.log(`Created file:\n${f}`)).catch((e) => console.error(e.message || e.toString()))
	})

program
	.command('prepare <image>')
	.description('prepare image config by startup.yml, copying conf files from image if needed')
	.alias('p')
	.option('-c, --config-file <name>', 'specific another config file name to use')
	.action((image, cmd) => {
		handled = true
		const configFile = cmd.configFile
		prepare({
			configFile,
			cwd: process.cwd(),
			imageName: image
		}).then((out) => {
			for (const info of out) {
				const msg = `${info.type === 'exist' ? 'already exist' : 'copied from image'}: ${info.filePath}`
				console.log(msg)
			}
		}).catch((e) => console.error(e.message || e.toString()))
	})

program
	.command('run <image>')
	.description('exec `docker run` command using pre-defined arguments in startup.yml')
	.alias('r')
	.option('-c, --config-file <name>', 'specific another config file name to use')
	.action((image, cmd) => {
		handled = true
		const configFile = cmd.configFile
		startup({
			configFile,
			cwd: process.cwd(),
			imageName: image
		}).then((out) => console.log(out)).catch((e) => console.error(e.message || e.toString()))
	})

program.parse(process.argv)

if (!handled) {
	program.help()
	process.exit(0)
}
