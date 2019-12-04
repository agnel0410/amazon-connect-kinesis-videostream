#!/usr/bin/env bash

export s3StackName='kvs-stream-s3'
export mainStackName='kvs-stream'
export region='us-east-1'
# Create a S3 bucket
aws cloudformation deploy --region $region --template-file ../templates/s3-bucket.yaml --stack-name $s3StackName

# get S3 bucket name and assign it to the environment variable
echo $'\nS3 Bucket: '; aws cloudformation describe-stacks --stack-name $s3StackName --query "Stacks[0].Outputs[?OutputKey=='S3Bucket'].OutputValue" --no-paginate --output text
export S3Bucket=`aws cloudformation describe-stacks --stack-name $s3StackName --query "Stacks[0].Outputs[?OutputKey=='S3Bucket'].OutputValue" --no-paginate --output text`

# Package the Lambda functions using SAM
sam package \
    --region $region \
    --template-file ./templates/master.yaml \
    --s3-bucket $S3Bucket \
    --output-template-file ./templates/master-packaged.yaml

# Deploy SAM package for the lambda functions
sam deploy \
    --region $region \
    --template-file ./templates/master-packaged.yaml \
    --stack-name $mainStackName \
    --capabilities CAPABILITY_IAM

# View the output of cloudformation stack
aws cloudformation describe-stacks \
    --stack-name $mainStackName \
    --query 'Stacks[].Outputs'