![Esp-Client](https://github.com/binsim/postmelder/actions/workflows/PlatformIO.yml/badge.svg)
![Rpi-Server](https://github.com/binsim/postmelder/actions/workflows/Node.yml/badge.svg)

# Installation

## Docker
Für das Projekt wird [Docker](https://www.docker.com/products/docker-desktop/) verwendet.
Bevor die Docker Engine installiert werden kann, muss das Docker `apt repository` beim Raspberry Pi wie folgt angelegt werden:

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

Als nächstes muss Docker installiert werden. Dies kann beim Raspberry Pi durch folgenden Befehl gemacht werden:

```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-compose
```

Alle folgenden Befehle, die mit `docker-compose` beginnen, müssen in dem Ordner ausgeführt werden, der die `docker-compose.yml` beinhaltet.

Beim Bauen vom Dockerfile konnte öfters `dl-cdn.alpinelinux.org` nicht aufgelöst werden, dabei half es, während des Bauens folgenden Befehl auszuführen:

```bash
ping dl-cdn.alpinelinux.org
```

Zum Starten des Projekt-Containers wird dann folgender Befehl verwendet:

```bash
sudo docker-compose up -d
```

Während der Entwicklung kann folgender Befehl zum Starten des Containers verwendet werden:

```bash
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Zum Beenden des Containers kann folgender Befehl verwendet werden:

```bash
sudo docker-compose down
```

## MQTT

### Passwort setzen

Zum Setzen des Passworts für einen `$USERNAME` muss der nachfolgende Befehl ausgeführt werden. Dieser Befehl muss im Ordner ausgeführt werden, in dem auch die `docker-compose.yml` Datei liegt. Der angegebene Benutzername und das dazugehörige Passwort müssen dann in der `.env`-Datei eingefügt werden und entsprechend für die `esp-clients` angepasst werden.


```bash
sudo docker-compose exec mqtt mosquitto_passwd -c /mosquitto/config/mosquitto.passwd $USERNAME
```

Sollte die Passwortdatei noch nicht existieren, muss in der `mosquitto/conf/mosquitto.conf` die letzte Zeile auskommentiert werden (mit #). Nach dem Erstellen von Benutzername und Passwort muss die Auskommentierung wieder rückgangig gemacht werden.

# Einstellungen

## RP als Accesspoint

### Allgemeine Konfiguration Raspberry:

Hostname: `postmelder`

Benutzername: `administrator`

Passwort: `postmelder`

[Online Anleitung](https://raspberrytips.com/access-point-setup-raspberry-pi/)

1. WLAN aktivieren

```bash
  sudo raspi-config
```

  WLAN country Germany eingestellt

2. Wifi-Interface im Networkmanager aktivieren

```bash
sudo nmcli con add con-name hotspot ifname wlan0 type wifi ssid "Postmelder-Wifi"
```

3. Accesspoint-Sicherheitseinstellungen und Passwort festlegen

```bash
sudo nmcli con modify hotspot wifi-sec.key-mgmt wpa-psk
sudo nmcli con modify hotspot wifi-sec.psk "postmelder"
```

4. Als Accesspoint konfigurieren

```bash
sudo nmcli con modify hotspot 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared
```

5. SSID verstecken

Mit folgendem Befehl kann die SSID versteckt werden. (`true`: versteckt; `false`: öffentlich)

```bash
sudo nmcli con modify hotspot 802-11-wireless.hidden true
```

Nach dem Ausführen des Befehls muss der RaspberryPi neugestartet werden, um die Änderung zu übernehmen.

```bash
sudo reboot
```

6. Weitere Einstellungen

Weitere Einstellungen können mit folgendem Befehl getätigt werden:

```bash
sudo nmtui
```

# Elektrischer Aufbau

## ESP32 und Wägezelle

Zum Einsatz kommt ein ESP32 DevkitC V4 und eine 5kg-Wägezelle mit dem HX711 Wägezellenverstärker. Als Statusanzeige dient eine Common-Kathode RGB-LED.

![ESP32](https://github.com/binsim/postmelder/assets/148945984/db4f611c-a416-498d-8ce0-02bcdacfa60d)

Gibt die Waage unlogische Werte aus oder schwankt der Messwert ständig, liegt das wahrscheinlich an schlechtem elektrischen Kontakt der Wägezelle zum Verstärker. Das kann behoben werden, indem die gecrimpten Stecker an der Wägezelle nachgepresst werden.

![nachpressen](https://github.com/binsim/postmelder/assets/148945984/3178d065-aa17-4d21-8830-6b275fb2cb63)

## Raspberry Pi

Zum Einsatz kommt ein Raspberry Pi 4B. Als Statusanzeige dient eine Common-Kathode RGB-LED.

![RaspberryPi](https://github.com/binsim/postmelder/assets/148945984/aaae5b55-50ee-48cd-8737-964f64a09dfe)

# Konfiguration und Anzeige der Postfächer

Zur Konfiguration der Postfächer steht eine Website zur Verfügung. Diese ist erreichbar unter <http://POSTMELDER_IP:8080> (Client und Raspberry Pi müssen im selben Netzwerk sein, z.B. Client im `Postmelder-Wifi`). Des Weiteren unterstüzt die Website eine automatische Erkennung von neuen Postfächern, welche dann entsprechend konfiguriert werden können (siehe folgende Punkte).

## E-Mail

Zum Senden der E-Mail muss ein SMTP-Sender hinzugefügt werden. Dies ist in der folgenden Ansicht möglich.

![SMTP-Sender_config]()

## Postfach

Des Weiteren ist es möglich, den Text sowie den Titel der E-Mail Benachrichtigung für jedes einzelne Postfach zu bearbeiten. Dies geschieht in folgender Ansicht. Hierbei werden auch Variablen unterstüzt.

| Variable | Wert |
| -------- | ---- |
| `{BOXNR}` | Die festgelegte Nummer des Postfachs |
| `{WEIGHT}` | Das zum Sendezeitpunkt aktuelle Gewicht |
| `{LASTEMPTIED}` | Der Zeitpunkt der letzten Entleerung im Zeitformat der Raspberry Pi's |
| `{HISTORY}` | Die Gewichtsänderungen mit entsprechenden Zeitpunkten seit der letzten Entleerung |

Um die Empfänger der E-Mails vor zu vielen Nachrichten zu schützen, ist es auch möglich, das Überprüfungsintervall zu ändern. Dafür gibt es folgende Möglichkeiten:

| Wert | Beschreibung |
| ---- | ------------ |
| `immediatly` | Senden, direkt bei Belegen des Fachs |
| `hourly` | Zur jeder vollen Stunde wird auf Statusänderung geprüft |
| `daily` | Es wird täglich auf Statusänderung geprüft |
| `weekly` | Es wird wöchentlich auf Statusänderung geprüft |

![Postfach_config]()

# Status-LEDS

## ESP32
| Farbe | Beschreibung |
| ---- | ------------- |
| aus | alles i.O. |
| rot (blinkt) | <ul><li>Kommunikationsfehler zum Raspberry Pi</li><li>Verbindungsfehler zur Wägezelle</li></ul> |
| grün (leuchtet) | Postfach ist belegt |
| blau (blinkt) | <ul><li>Initialisierung nach dem Starten</li><li>Kalibrieren der Wägezelle</li></ul> |

## Raspberry Pi
| Farbe | Beschreibung |
| ---- | ------------- |
| rot | <ul><li>keine Internetverbindung</li><li>Verbindungsfehler MQTT</li><li>Fehler beim Senden der Email</li></ul> |
| grün | alles i.O. |
| blau | Kommunikationsfehler zu min. 1 ESP32 |
