# Installation

## Docker

Für das Verwenden wird [Docker](https://www.docker.com/products/docker-desktop/) verwendet und muss dem entsprechend installiert werden. Dies kann beim Raspberry Pi durch folgenden Befehl installiert werden.

```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Alle folgende Befehle, die mit 'docker-compose' beginnen müssen in dem Ordner ausgeführt werden, der die `docker-compose.yml` beinhaltet.

Zum starten der Application wird folgender Befehl verwendet:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Während der Entwicklung kann folgender Befehl verwendet werden:

```bash
docker-compose up -d
```

Zum Beenden kann folgender Befehl verwendet werden:

```bash
docker-compose down
```

## MQTT

### Passwort setzen

Zum setzen des Passworts für einen $USERNAME, folgenden Befehl ausführen. Dieses Benutzername und Passwort müssen dann in der .env Datei eingefügt werden und entsprechend für die esp-clients angepasst werden

Dieser Befehl muss im Ordner ausgeführt werden, in der auch die `docker-compose.yml` Datei liegt

```bash
docker-compose exec mqtt mosquitto_passwd -c /mosquitto/config/mosquitto.passwd $USERNAME
```
