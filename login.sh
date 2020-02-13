#!/bin/bash
if [ -z "$1" ]
  then
    echo "Argument MFA token is required"
    exit 1
fi

TOKEN=$1
echo $TOKEN

mfa_device=$(aws configure get default.aws_mfa_device)
echo $mfa_device

credentials=($(aws sts get-session-token --serial-number ${mfa_device} --token-code ${TOKEN} --output text | tr ' ' "\n"))
echo $credentials

aws configure set aws_access_key_id ${credentials[1]} --profile sf_temp
aws configure set aws_secret_access_key ${credentials[3]} --profile sf_temp 
aws configure set aws_session_token ${credentials[4]} --profile sf_temp