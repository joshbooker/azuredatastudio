/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { QueryTextEditor } from 'sql/parts/modelComponents/queryTextEditor';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { SimpleProgressService } from 'vs/editor/standalone/browser/simpleServices';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModel } from 'vs/editor/common/model';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import URI from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import * as DOM from 'vs/base/browser/dom';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';


export const CODE_SELECTOR: string = 'code-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./code.component.html'))
})
export class CodeComponent extends AngularDisposable implements OnInit {
	@ViewChild('toolbar', { read: ElementRef }) private toolbarElement: ElementRef;
	@ViewChild('editor', { read: ElementRef }) private codeElement: ElementRef;
	@Input() id: string;
	@Input() content: string;
	@Input() language: string;

	private readonly _minimumHeight = 30;
	private _editor: QueryTextEditor;
	private _editorInput: UntitledEditorInput;
	private _editorModel: ITextModel;
	private _uri: string;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IModelService) private _modelService: IModelService,
		@Inject(IModeService) private _modeService: IModeService
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
	}

	ngOnChanges() {
		this.updateLanguageMode();
		this.updateModel();
	}

	ngAfterContentInit(): void {
		this.createEditor();
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this.layout();
		}));
	}

	private createEditor(): void {
		let instantiationService = this._instantiationService.createChild(new ServiceCollection([IProgressService, new SimpleProgressService()]));
		this._editor = instantiationService.createInstance(QueryTextEditor);
		this._editor.create(this.codeElement.nativeElement);
		this._editor.setVisible(true);
		this._editor.setMinimumHeight(this._minimumHeight);
		let uri = this.createUri();
		this._editorInput = instantiationService.createInstance(UntitledEditorInput, uri, false, this.language, '', '');
		this._editor.setInput(this._editorInput, undefined);
		this._editorInput.resolve().then(model => {
			this._editorModel = model.textEditorModel;
			this._modelService.updateModel(this._editorModel, this.content);
		});

		this._register(this._editor);
		this._register(this._editorInput);
		this._register(this._editorModel.onDidChangeContent(e => {
			this.content = this._editorModel.getValue();
			this._editor.setHeightToScrollHeight();
		}));
		this.layout();
	}

	public layout(): void {
		this._editor.layout(new DOM.Dimension(
			DOM.getContentWidth(this.codeElement.nativeElement),
			DOM.getContentHeight(this.codeElement.nativeElement)));
		this._editor.setHeightToScrollHeight();
	}

	private createUri(): URI {
		let uri = URI.from({ scheme: Schemas.untitled, path: `notebook-editor-${this.id}` });
		// Use this to set the internal (immutable) and public (shared with extension) uri properties
		this._uri = uri.toString();
		return uri;
	}

	/// Editor Functions
	private updateModel() {
		if (this._editorModel) {
			this._modelService.updateModel(this._editorModel, this.content);
		}
	}

	private updateLanguageMode() {
		if (this._editorModel && this._editor) {
			this._modeService.getOrCreateMode(this.language).then((modeValue) => {
				this._modelService.setMode(this._editorModel, modeValue);
			});
		}
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbarElement.nativeElement;
		toolbarEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}
}
