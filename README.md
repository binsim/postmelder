![Esp-Client](https://github.com/binsim/postmelder/actions/workflows/PlatformIO.yml/badge.svg)
![Rpi-Server](https://github.com/binsim/postmelder/actions/workflows/Node.yml/badge.svg)

# Installation

## Docker

Bevor Docker Engine installiert werden kann, muss das Docker apt repository wie folgt angelegt werden:

```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources:
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```

Für das Verwenden wird [Docker](https://www.docker.com/products/docker-desktop/) verwendet und muss dementsprechend installiert werden. Dies kann beim Raspberry Pi durch folgenden Befehl installiert werden:

```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-compose
```

Alle folgenden Befehle, die mit 'docker-compose' beginnen, müssen in dem Ordner ausgeführt werden, der die `docker-compose.yml` beinhaltet.

Beim bauen vom Dockerfile konnte `dl-cdn.alpinelinux.org` nicht aufgelöst werden, dabei half es während der Bauens folgendem Befehl auszuführen:

```bash
ping dl-cdn.alpinelinux.org
```

Zum starten der Application wird folgender Befehl verwendet:

```bash
sudo docker-compose up -d
```

Während der Entwicklung kann folgender Befehl verwendet werden:

```bash
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Zum Beenden kann folgender Befehl verwendet werden:

```bash
sudo docker-compose down
```

## MQTT

### Passwort setzen

Zum setzen des Passworts für einen $USERNAME, folgenden Befehl ausführen. Dieses Benutzername und Passwort müssen dann in der .env Datei eingefügt werden und entsprechend für die esp-clients angepasst werden.

Dieser Befehl muss im Ordner ausgeführt werden, in der auch die `docker-compose.yml` Datei liegt.

```bash
sudo docker-compose exec mqtt mosquitto_passwd -c /mosquitto/config/mosquitto.passwd $USERNAME
```

Sollte die Passwortdatei noch nicht existieren, muss in der `mosquitto/conf/mosquitto.conf` die letzte Zeile auskommentiert werden (mit #). Nach dem Erstellen von Benutzername und Passwort muss die Auskommentierung wieder rückgangig gemacht werden.

# Einstellungen

## RP als Accesspoint

### Allgemeine Konfiguration Raspberry:

Hostname: postmelder

Benutzername: administrator

Passwort: postmelder

[Online Anleitung](https://raspberrytips.com/access-point-setup-raspberry-pi/)

1. Schritt WLAN aktivieren:

```bash
  sudo raspi-config
```

WLAN country Germany eingestellt

2. Enable Wifi Interface im Networkmanager:

```bash
sudo nmcli con add con-name hotspot ifname wlan0 type wifi ssid "Postmelder-Wifi"
```

3. Set Access Point Security und Password:

```bash
sudo nmcli con modify hotspot wifi-sec.key-mgmt wpa-psk
sudo nmcli con modify hotspot wifi-sec.psk "postmelder"
```

4. Configure to Run as Access Point:

```bash
sudo nmcli con modify hotspot 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared
```

5. Hide SSID

Mit folgendem Befehl kann die SSID versteckt werden. (true: versteckt; false: öffentlich)

```bash
sudo nmcli con modify hotspot 802-11-wireless.hidden true
```

Nach dem Ausführen des Befehls muss der RaspberryPi neugestartet werden, um die Änderung zu übernehmen.

6. Weitere Einstellung

Weitere Einstellung können mit folgenden Befehl getätigt werden:

```bash
sudo nmtui
```
