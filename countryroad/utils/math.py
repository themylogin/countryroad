def overlap(a, b):
    a = sorted(a)
    b = sorted(b)
    return a[0] <= b[0] <= a[1] or a[0] <= b[1] <= a[1] or b[0] <= a[0] <= b[1] or b[0] <= a[1] <= b[1]
