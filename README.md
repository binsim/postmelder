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

## RP als Accesspoint

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

3. Schritt: Install Services for Hotspot:
```bash
  sudo apt install hostapd dnsmasq
```

4. Schritt: Configuration Hostadp:
```bash
  sudo nano /etc/hostapd/hostapd.conf
```
Konfiguration:
```bash
  interface=wlan0
  driver=nl80211
  ssid=RaspberryTips-Wifi
  hw_mode=g
  channel=6
  wmm_enabled=0
  macaddr_acl=0
  auth_algs=1
  ignore_broadcast_ssid=0
  wpa=2
  wpa_passphrase=postmelder
  wpa_key_mgmt=WPA-PSK
  wpa_pairwise=TKIP
  rsn_pairwise=CCMP
```
Ändern von:
```bash
sudo nano /etc/default/hostapd
```
Anhängen am Ende mit:
```bash
DAEMON_CONF="/etc/hostapd/hostapd.conf"
```

5. Schritt: Aktivieren der Service
```bash
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
```

6. Configure DNSMasq:
```bash
  sudo nano /etc/dnsmasq.conf
```
Einfügen am Ende:
```bash
interface=wlan0
bind-dynamic
domain-needed
bogus-priv
dhcp-range=192.168.42.100,192.168.42.200,255.255.255.0,12h
```
range müssen wir dann vielleicht noch einstellen. Habs aber fürs erste so gelassen

7. Configure the DHCP server:
```bash
  sudo nano /etc/dhcpcd.conf
```
Datei nicht gefunden! Neue Datei erstellt mit:
Lines added:
```bash
nohook wpa_supplicant
interface wlan0
static ip_address=192.168.42.10/24
static routers=192.168.42.1
```

Status Hostapd:
```bash
sudo systemctl status hostapd
```






