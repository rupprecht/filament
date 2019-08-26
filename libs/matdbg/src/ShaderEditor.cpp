/*
 * Copyright (C) 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <matdbg/ShaderEditor.h>

#include <backend/DriverEnums.h>

#include <utils/Log.h>

namespace filament {
namespace matdbg {

using namespace backend;
using namespace filamat;

ShaderEditor::ShaderEditor(Backend backend, const void* data, size_t size) :
        mBackend(backend), mOriginalPackage(data, size), mMaterialChunk(mOriginalPackage) {
    switch (backend) {
        case Backend::OPENGL:
            mMaterialTag = ChunkType::MaterialGlsl;
            mDictionaryTag = ChunkType::DictionaryGlsl;
            break;
        case Backend::METAL:
            mMaterialTag = ChunkType::MaterialMetal;
            mDictionaryTag = ChunkType::DictionaryMetal;
            break;
        case Backend::VULKAN:
            mMaterialTag = ChunkType::MaterialSpirv;
            mDictionaryTag = ChunkType::DictionarySpirv;
            break;
        default:
            break;
    }
}

ShaderEditor::~ShaderEditor() {
    delete mEditedPackage;
}

bool ShaderEditor::applyShaderEdit(backend::ShaderModel shaderModel, uint8_t variant,
            backend::ShaderType stage, const char* source) {
    utils::slog.e << "TODO: apply edit" << utils::io::endl;

    size_t size = mOriginalPackage.getSize();
    uint8_t* data = new uint8_t[size];
    memcpy(data, mOriginalPackage.getData(), size);
    mEditedPackage = new filaflat::ChunkContainer(data, size);

    return true;
}

const uint8_t* ShaderEditor::getEditedPackage() const {
    return  (const uint8_t*) mEditedPackage->getData();

}

size_t ShaderEditor::getEditedSize() const {
    return  mEditedPackage->getSize();
}

} // namespace matdbg
} // namespace filament
