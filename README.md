# docker-startup
A start-up tool of docker to exec run command with pre-defined arguments

## Install

```bash
npm install -g docker-startup
```

## Example

To run a mysql container, with directory contains `my.cnf` mounting to it

#### Step 1

```bash
docker-startup init
```

A startup.yml file is created, edit it's `containerName` and `configFileMount` property

```yaml
# container name (--name argument of docker run)
containerName: 'mysql'

# special type of mount volumes, in prepare command, if source config file not exist, it will create by
# copying from image
configFileMount:
  - 'my.cnf:/etc/mysql/my.cnf'
```

#### Step 2

```bash
docker-startup prepare -r /home/mysql/docker_mysql_container mysql
```

In this command, docker-startup will check config file in `/home/mysql/docker_mysql_container/mysql/my.cnf`,
if not exist, a `my.cnf` file will be create by copying from mysql image, you can modify it before doing step 3

#### Step 3

```bash
docker-startup run -r /home/mysql/docker_mysql_container mysql
```

A container named `mysql` is started

## License

MIT
