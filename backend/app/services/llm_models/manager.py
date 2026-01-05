import os
import json

class ModelManager:
    def __init__(self, base_path: str = None):
        if not base_path:
            # Default to current file dir
            base_path = os.path.dirname(os.path.abspath(__file__))
        self.base_path = base_path
        self.models = {}
        self.load_models()

    def load_models(self):
        # Walk directories
        if not os.path.exists(self.base_path):
            return

        for name in os.listdir(self.base_path):
            path = os.path.join(self.base_path, name)
            if os.path.isdir(path):
                # This is a model directory
                self.models[name] = {}
                for filename in os.listdir(path):
                    if filename.endswith(".json"):
                        interface_name = filename[:-5]
                        try:
                            with open(os.path.join(path, filename), 'r') as f:
                                data = json.load(f)
                                self.models[name][interface_name] = data
                        except Exception as e:
                            print(f"Error loading model definition for {name}/{filename}: {e}")

    def get_model_validation_info(self, model_name: str, model_type: str):
        # Return validation info based on type
        # For image models, look for 'create_image_task'
        # For video models, look for 'create_video_task'
        
        model_info = self.models.get(model_name)
        if not model_info:
            return None
            
        if model_type == "image":
            return model_info.get("create_image_task")
        elif model_type == "video":
            return model_info.get("create_video_task")
        
        return None

model_manager = ModelManager()
