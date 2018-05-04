import { exec } from 'child_process'
import { copyFile, exists, readFile } from 'fs'
import * as mkdirp from 'mkdirp'
import { homedir } from 'os'
import { basename, dirname, join } from 'path'
import { promisify } from 'util'
import * as YAML from 'yamljs'

const copyFileAsync = promisify(copyFile)
const existsAsync = promisify(exists)
const readFileAsync = promisify(readFile)
const execAsync = promisify(exec)

const DEFAULT_CONFIG_FILE = 'startup.yml'

export interface BaseOption {
	configFile: string
	cwd: string
}

export interface CommonOption extends BaseOption {
	volumeRoot: string
	imageName: string
}

export interface PrepareResultItem {
	type: 'new' | 'exist'
	filePath: string
}

interface ConfigProps {
	containerName: string
	deamon: boolean
	directoryMount: string[]
	configFileMount: string[]
	portMap: string[]
	volumeSubDirectory: string
	otherArguments: string
}

interface PathMap {
	hostPath: string
	containerPath: string
}

export async function init(option: BaseOption) {
	const f = option.configFile || DEFAULT_CONFIG_FILE
	const configFile = join(option.cwd, f)
	if (await existsAsync(configFile)) {
		throw new Error(`${f} is already exists`)
	}
	await copyFileAsync(join(__dirname, '../resource/default.startup.yml'), configFile)
	return configFile
}

export async function prepare(option: CommonOption) {
	const resultList: PrepareResultItem[] = []
	const c = await readConfig(option)
	const fileMap = getVolumeMap(
		c.configFileMount,
		getAbsolutePath(option.volumeRoot, option.cwd), getSubDirectory(c)
	)
	for (const m of fileMap) {
		const ext = await existsAsync(m.hostPath)
		if (ext) {
			resultList.push({
				type: 'exist',
				filePath: m.hostPath
			})
			continue
		}
		const cmd = `docker run --rm -v "${dirname(m.hostPath)}:/copy_data_tmp" ${option.imageName} ` +
			`bash -c "stat ${m.containerPath} > /dev/null && cp -r ${m.containerPath} /copy_data_tmp/${basename(m.hostPath)}"`
		await execAsync(cmd, {
			cwd: option.cwd,
			env: process.env
		})
		resultList.push({
			type: 'new',
			filePath: m.hostPath
		})
	}
	return resultList
}

export async function startup(option: CommonOption) {
	const c = await readConfig(option)
	const args = generateDockerRunArguments(c, getAbsolutePath(option.volumeRoot, option.cwd))
	const cmd = 'docker run' + args + option.imageName
	const execResult = await execAsync(cmd, {
		cwd: option.cwd,
		env: process.env
	})
	return execResult.stdout
}

async function readConfig(option: CommonOption): Promise<ConfigProps> {
	const f = option.configFile || DEFAULT_CONFIG_FILE
	const configFile = join(option.cwd, f)
	if (!(await existsAsync(configFile))) {
		throw new Error(`Could not find ${f}`)
	}
	const configContent = await readFileAsync(configFile, 'utf8')
	const configYml = YAML.parse(configContent)
	return {
		deamon: true,
		directoryMount: [],
		configFileMount: [],
		portMap: [],
		...configYml
	}
}

function getVolumeMap(mountMap: string[], volumeRoot: string, volumeSubDirectory: string): PathMap[] {
	const rs: PathMap[] = []
	for (const m of mountMap) {
		const s = m.split(':')
		if (!s || s.length !== 2) {
			return
		}
		const src = s[0]
		const dest = s[1]
		const fullSrc = volumeSubDirectory ? join(volumeRoot, volumeSubDirectory, src) : join(volumeRoot, src)
		rs.push({
			hostPath: tailEndSlash(fullSrc),
			containerPath: tailEndSlash(dest)
		})
	}
	return rs
}

function tailEndSlash(str: string) {
	return str && str.endsWith('/') ? str.substr(0, str.length - 1) : str
}

function generateDockerRunArguments(c: ConfigProps, volumeRoot: string) {
	let args = ''
	if (c.deamon) {
		args += ' -d'
	}
	if (c.containerName) {
		args += ' --name ' + c.containerName
	}
	for (const p of c.portMap) {
		args += ' -p ' + p
	}
	const fileVolumeMap = getVolumeMap(c.configFileMount, volumeRoot, getSubDirectory(c))
	for (const v of fileVolumeMap) {
		args += ` -v ${v.hostPath}:${v.containerPath}`
	}
	const dirVolumeMap = getVolumeMap(c.directoryMount, volumeRoot, getSubDirectory(c))
	for (const v of dirVolumeMap) {
		args += ` -v ${v.hostPath}:${v.containerPath}`
	}
	if (c.otherArguments) {
		args += ' ' + c.otherArguments
	}
	args += ' '
	return args
}

function getAbsolutePath(path: string, cwd: string) {
	if (path.startsWith('~')) {
		return join(homedir(), path.substr(1))
	}
	if (!path.startsWith('/')) {
		return join(cwd, path)
	}
	return path
}

function getSubDirectory(c: ConfigProps) {
	return c.volumeSubDirectory || c.containerName
}
