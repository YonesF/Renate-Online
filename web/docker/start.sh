#!/bin/sh
# Oppstart for web: gjør databasen klar, så starter Apache.
#
# Databasen ligger i et Docker-volum på hver maskin og følger ikke med i git.
# Derfor kjøres migrasjonene og importen av knowledge/ hver gang web starter.
# Begge er trygge å kjøre flere ganger: det som allerede er gjort, hoppes over.
#
# Feiler noe, startes nettsiden likevel, slik at feilen kan leses i loggen
# (docker compose logs web) og sjekkes med bin/console env:check.

cd /app/web || exit 1

# MySQL kan trenge litt tid etter at den melder seg klar første gang.
tries=0
until php bin/console updatedb; do
    tries=$((tries + 1))
    if [ "$tries" -ge 15 ]; then
        echo "start: FEIL: databasen ble ikke klar. Nettsiden starter uten oppdatert database." >&2
        break
    fi
    echo "start: venter på databasen ($tries av 15) …" >&2
    sleep 2
done

if ! php bin/console kb:import; then
    echo "start: FEIL: importen av knowledge/ feilet. Se meldingen over." >&2
fi

exec docker-php-entrypoint apache2-foreground
