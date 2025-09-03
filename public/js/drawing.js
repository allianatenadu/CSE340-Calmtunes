class DrawingApp {
  constructor() {
    this.canvas = document.getElementById("drawing-canvas");
    
    // Exit early if canvas doesn't exist (not on drawing page)
    if (!this.canvas) {
      return;
    }
    
    this.ctx = this.canvas.getContext("2d");

    this.isDrawing = false;
    this.currentTool = "pencil";
    this.currentColor = "#000000";
    this.currentSize = 5;

    this.initCanvas();
    this.bindEvents();
  }

  initCanvas() {
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
  }

  bindEvents() {
    // Tool buttons
    document.getElementById("pencil-tool").addEventListener("click", () => this.setTool("pencil"));
    document.getElementById("brush-tool").addEventListener("click", () => this.setTool("brush"));
    document.getElementById("eraser-tool").addEventListener("click", () => this.setTool("eraser"));

    // Color buttons
    document.querySelectorAll(".color-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.currentColor = btn.dataset.color;
        this.ctx.strokeStyle = this.currentColor;
        document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // Custom color picker
    document.getElementById("custom-color").addEventListener("change", (e) => {
      this.currentColor = e.target.value;
      this.ctx.strokeStyle = this.currentColor;
    });

    // Brush size
    const sizeSlider = document.getElementById("brush-size");
    const sizeDisplay = document.getElementById("size-display");
    sizeSlider.addEventListener("input", (e) => {
      this.currentSize = parseInt(e.target.value);
      this.ctx.lineWidth = this.currentSize;
      sizeDisplay.textContent = `${this.currentSize}px`;
    });

    // Clear
    document.getElementById("clear-canvas").addEventListener("click", () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    });

    // Save - SINGLE event listener
    document.getElementById("save-artwork").addEventListener("click", () => this.saveDrawing());

    // Delete artwork buttons
    document.querySelectorAll(".delete-artwork").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = btn.dataset.id;
        if (!confirm("Delete this artwork?")) return;

        const res = await fetch(`/drawing/${id}`, { method: "DELETE" });
        const data = await res.json();

        if (data.success) {
          btn.closest("div").remove(); // remove from gallery
        } else {
          alert("Failed to delete");
        }
      });
    });

    // Mouse events
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseout", () => this.stopDrawing());

    // Touch events
    this.canvas.addEventListener("touchstart", (e) => this.startDrawing(e));
    this.canvas.addEventListener("touchmove", (e) => this.draw(e));
    this.canvas.addEventListener("touchend", () => this.stopDrawing());
  }

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll(".tool-btn").forEach(btn => {
      btn.classList.remove("active", "bg-primary", "text-white");
      btn.classList.add("bg-gray-200", "text-gray-700");
    });
    const activeBtn = document.getElementById(`${tool}-tool`);
    activeBtn.classList.add("active", "bg-primary", "text-white");
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;

    // Scale coordinates properly
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  startDrawing(e) {
    e.preventDefault();
    this.isDrawing = true;
    const pos = this.getPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  draw(e) {
    if (!this.isDrawing) return;
    const pos = this.getPos(e);

    if (this.currentTool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out";
    } else {
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.strokeStyle = this.currentColor;
    }

    this.ctx.lineWidth = this.currentSize;
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.ctx.moveTo(pos.x, pos.y);

    // Hide instructions on first stroke
    document.getElementById("canvas-instructions").style.display = "none";
  }

  stopDrawing() {
    this.isDrawing = false;
    this.ctx.closePath();
  }

  async saveDrawing() {
    try {
      const imageData = this.canvas.toDataURL("image/png");
      const res = await fetch("/drawing/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData }),
      });

      const data = await res.json();
      if (data.success) {
        alert("🎨 Artwork saved!");
        location.reload();
      } else {
        alert("Save failed: " + data.message);
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Error saving artwork");
    }
  }
}

// Initialize the app when DOM is ready - only on drawing page
document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on the drawing page by looking for the canvas element
  const canvas = document.getElementById("drawing-canvas");
  if (canvas) {
    new DrawingApp();
  }
});