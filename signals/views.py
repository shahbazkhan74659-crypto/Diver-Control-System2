from django.shortcuts import render

# Create your views here.
def detect_view(request):
    return render(request, "signals/detect.html")
