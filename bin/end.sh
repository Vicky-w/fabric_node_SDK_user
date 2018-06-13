#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

echo "KILL PORT == " $1
KILLID=`netstat -altunp | grep $1| awk 'BEGIN{FS=" "}{print$7}'|awk 'BEGIN{FS="/"}{print$1}'`
echo "KILL PID===>" $KILLID
kill -9 $KILLID
echo "KILL SUCCESS PID ===>" $KILLID
