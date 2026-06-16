# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file from the backend folder to the container
COPY backend/requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the content of the backend directory into /app
COPY backend/ .

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Run app.py directly from the /app directory
CMD ["gunicorn", "--workers", "1", "--timeout", "300", "--bind", "0.0.0.0:8080", "app:app"]