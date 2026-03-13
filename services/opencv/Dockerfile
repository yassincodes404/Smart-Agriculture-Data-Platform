FROM python:3.11

WORKDIR /cv

RUN pip install --default-timeout=1000 opencv-python pillow numpy

COPY . .

CMD ["python"]