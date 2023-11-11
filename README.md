![Esp-Client](https://github.com/binsim/postmelder/actions/workflows/PlatformIO.yml/badge.svg)
![Rpi-Server](https://github.com/binsim/postmelder/actions/workflows/Node.yml/badge.svg)

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

# Einstellungen

## Mail

Um Mails versenden zu können, muss eine `mail.json` Datei im `data`-Ordner in `rpi-server` angelegt werden. Ein Beispiel für den Inhalt wird folgend gezeigt. Für weitere Einstellungen und Hilfe kann die offizielle [Dokumentation](https://nodemailer.com/smtp/) herangezogen werden, dabei ist jedoch zu achten, dass sich alle Attribute innerhalb des _transporter_ Attributes befinden.

```json
{
	"transporter": {
		"host": "smtp.example.com",
		"port": 587,
		"secure": true,
		"auth": {
			"user": "username",
			"pass": "password"
		}
	}
}
```

## RP als Accesspoint

### Allgemeine Konfiguration Raspberry:

Hostname: postmelder

Benutzername: administrator

Passwort: postmelder

[Online Anleitung](https://raspberrytips.com/access-point-setup-raspberry-pi/)

1. Schritt Update:

```bash
 sudo apt update
 sudo apt upgrade -y
```

2. Schritt WLAN aktivieren:

```bash
  sudo raspi-config
```

WLAN country Germany eingestellt

3. Enable Wifi Interface im Networkmanager:

```bash
sudo nmcli con add con-name hotspot ifname wlan0 type wifi ssid "Postmelder-Wifi"
```

4. Set Access Point Security und Password:

```bash
sudo nmcli con modify hotspot wifi-sec.key-mgmt wpa-psk
sudo nmcli con modify hotspot wifi-sec.psk "postmelder"
```

5. Configure to Run as Access Point

```bash
sudo nmcli con modify hotspot 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared
```

Einstellung können mit folgenden Befehl getätigt werden:

```bash
sudo nmtui
```
