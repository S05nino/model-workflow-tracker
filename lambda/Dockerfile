# Lambda Docker image for TestSuite Runner
# Based on AWS Lambda Python 3.11 with .NET 8 runtime support

FROM public.ecr.aws/lambda/python:3.11

# Install .NET 8 runtime (required by CategorizationEnginePython)
RUN yum install -y \
    libicu \
    && yum clean all

# Install .NET 8 runtime
RUN rpm -Uvh https://packages.microsoft.com/config/centos/7/packages-microsoft-prod.rpm \
    && yum install -y dotnet-runtime-8.0 \
    && yum clean all

# Copy CategorizationEnginePython library
# NOTE: You need to place the CategorizationEnginePython directory here before building
COPY CategorizationEnginePython/ /opt/CategorizationEnginePython/

# Install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy handler
COPY handler.py ${LAMBDA_TASK_ROOT}/

# Set handler
CMD ["handler.handler"]
