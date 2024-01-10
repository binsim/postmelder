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

# Elektrischer Aufbau

## ESP32 und Wägezelle

Zum Einsatz kommt ein ESP32 DevkitC V4 und eine 5kg-Wägezelle mit dem HX711 Wägezellenverstärker. Als Statusanzeige dient eine RGB-LED.

![ESP32](https://github.com/binsim/postmelder/assets/148945984/db4f611c-a416-498d-8ce0-02bcdacfa60d)

## Raspberry Pi

Zum Einsatz kommt ein Raspberry Pi 4B. Als Statusanzeige dient eine RGB-LED.

![RaspberryPi](https://github.com/binsim/postmelder/assets/148945984/aaae5b55-50ee-48cd-8737-964f64a09dfe)

# Konfiguration und Anzeige der Postfächer

Zur Konfiguration der Postfächer steht eine Website zur Verfügung. Diese ist erreichbar unter <http://POSTMELDER_IP:8080>. Desweiteren unterstüzt die Website eine automatische Erkennung von neuen Postfächern diese dann entsprechen konfiguriert werden können (siehe folgende Punkte).

## E-Mail

Zum senden von E-Mail muss ein SMTP-Sender hinzugefügt werden. Dies ist durch folgende Ansicht möglich.

![SMTP-Sender_config]()

## Postfach

Des weiteren ist es möglich, den Test sowie den Titel des E-Mail Benachrichtigung für jedes einzele Postfach zu bearbeiten. Dies geschieht unter folgender Ansicht. Hierbei werden auch Variablen unterstüzt.

| Variable | Wert |
| -------- | ---- |
| `{BOXNR}` | Die entsprechende Boxnumber des Postfach |
| `{WEIGHT}` | Das im Moment des Sendens aktuelle Gewicht |
| `{LASTEMPTIED}` | Der Zeitpunkt der letzten Entleerung im Zeitformat der Raspberry Pi's |
| `{HISTORY}` | Die Gewichtsänderungen mit entsprechenden Zeitpunkten seit der letzten Entleerung |

Um den Empfänger der E-Mail vor zu viele Nachrichten zu schützen ist es auch möglich, das Überprüfungsintervall zu ändern, hierfür gibt es folgende möglichkeiten

| Wert | Beschreibung |
| ---- | ------------ |
| `immediatly` | Es wird direkt nach dem das Postfach zu belegt wird |
| `hourly` | Zur jeden vollen Stunde wird auf Statusänderung geprüft |
| `daily` | Es wird täglich auf Statusänderung geprüft |
| `weekly` | Es wird wöchentlich auf Statusänderung geprüft |

![Postfach_config]()

