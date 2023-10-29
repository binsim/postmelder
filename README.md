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
