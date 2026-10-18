#!/bin/bash
# usage: run.sh file.sql  — يشغّل على قاعدة arb المحلية
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d arb -f "$1" 2>&1
