function setPropertyRequired(attributeName, boolValue = true) {
  //обов"язкове
  var attributeProps = EdocsApi.getControlProperties(attributeName);
  attributeProps.required = boolValue;
  EdocsApi.setControlProperties(attributeProps);
}

function setPropertyHidden(attributeName, boolValue = true) {
  //приховане
  var attributeProps = EdocsApi.getControlProperties(attributeName);
  attributeProps.hidden = boolValue;
  EdocsApi.setControlProperties(attributeProps);
}

function setPropertyDisabled(attributeName, boolValue = true) {
  //недоступне
  var attributeProps = EdocsApi.getControlProperties(attributeName);
  attributeProps.disabled = boolValue;
  EdocsApi.setControlProperties(attributeProps);
}

//Скрипт 1. Вирахування ПДВ рахунку
function onChangeAccountInvoice() {
  var VATpercentage = 0;
  var attrVATAmount = EdocsApi.getAttributeValue("InvoiceVATAmount"); //сума ПДВ
  var attrVATpercentage = EdocsApi.getAttributeValue("InvoiceVATPercent"); //Відсоток ПДВ вибір
  var attrContractAmount = EdocsApi.getAttributeValue("AccountInvoice"); //сума рахунку
  var attrAmountOutVAT = EdocsApi.getAttributeValue("InvoiceAmountOutVAT"); //Сума рахунку, без ПДВ

  switch (attrVATpercentage.value) {
    case "20%": // if (x === 'если сумма НДС=20%')
      var VATpercentage = 1.2;
      break;

    case "7%": // if (x === 'если сумма НДС=7%')
      var VATpercentage = 1.07;
      break;
  }

  if (attrVATpercentage.value === null || attrContractAmount.value === null) {
    // если нет ставки НДС и суммы, то укажем ноль в сумме НДС и без НДС
    attrVATAmount.value = 0;
    attrAmountOutVAT.value = 0;
  } else if (VATpercentage == 0) {
    attrVATAmount.value = 0;
    attrAmountOutVAT.value = attrContractAmount.value;
  } else {
    attrAmountOutVAT.value = (attrContractAmount.value / VATpercentage).toFixed(
      2
    );
    attrVATAmount.value = (
      attrContractAmount.value - attrAmountOutVAT.value
    ).toFixed(2);
  }

  EdocsApi.setAttributeValue(attrVATAmount);
  EdocsApi.setAttributeValue(attrAmountOutVAT);
}

function onChangeInvoiceVATPercent() {
  onChangeAccountInvoice();
}

//Скрипт 2. Передача рахунку для ознайомлення  в зовнішню систему
// Відправлення на підпис в зовнішній сервіс eSign договору
//-------------------------------
function setDataForESIGN() {
  debugger;
  var registrationDate = EdocsApi.getAttributeValue("RegDate").value;
  var registrationNumber = EdocsApi.getAttributeValue("RegNumber").value;
  var caseType = EdocsApi.getAttributeValue("DocType").value;
  var caseKind = EdocsApi.getAttributeValue("DocKind").text;
  var name = "";
  if (caseKind) {
    name += caseKind;
  } else {
    name += caseType;
  }
  name +=
    " №" +
    (registrationNumber ? registrationNumber : CurrentDocument.id) +
    (!registrationDate
      ? ""
      : " від " + moment(registrationDate).format("DD.MM.YYYY"));
  doc = {
    DocName: name,
    extSysDocId: CurrentDocument.id,
    ExtSysDocVersion: CurrentDocument.version,
    docType: "invoice",
    docDate: registrationDate,
    docNum: registrationNumber,
    File: "",
    parties: [
      {
        taskType: "ToSign",
        taskState: "Done",
        legalEntityCode: EdocsApi.getAttributeValue("OrgCode").value,
        contactPersonEmail: EdocsApi.getAttributeValue("OrgRPEmail").value,
        signatures: [],
      },
      {
        taskType: "toRead",
        taskState: "NotAssigned",
        legalEntityCode: EdocsApi.getAttributeValue("ContractorCode").value,
        contactPersonEmail:
          EdocsApi.getAttributeValue("ContractorRPEmail").value,
        expectedSignatures: [],
      },
    ],
    additionalAttributes: [
      {
        code: "docDate",
        type: "dateTime",
        value: registrationDate,
      },
      {
        code: "docNum",
        type: "string",
        value: registrationNumber,
      },
    ],
    sendingSettings: {
      attachFiles: "fixed", //, можна також встановлювати 'firstOnly' - Лише файл із першої зафіксованої вкладки(Головний файл), або 'all' - всі файли, 'fixed' - усі зафіксовані
      attachSignatures: "signatureAndStamp", // -'signatureAndStamp'Типи “Підпис” або “Печатка”, можна також встановити 'all' - усі типи цифрових підписів
    },
  };
  EdocsApi.setAttributeValue({ code: "JSON", value: JSON.stringify(doc) });
}

function onTaskExecuteSendOutDoc(routeStage) {
  debugger;
  if (routeStage.executionResult == "rejected") {
    return;
  }
  setDataForESIGN();
  var idnumber = EdocsApi.getAttributeValue("DocId");
  var methodData = {
    extSysDocId: idnumber.value,
  };

  routeStage.externalAPIExecutingParams = {
    externalSystemCode: "ESIGN1", // код зовнішньої системи
    externalSystemMethod: "integration/importDoc", // метод зовнішньої системи
    data: methodData, // дані, що очікує зовнішня система для заданого методу
    executeAsync: true, // виконувати завдання асинхронно
  };
}

function onTaskCommentedSendOutDoc(caseTaskComment) {
  debugger;
  var orgCode = EdocsApi.getAttributeValue("OrgCode").value;
  var orgShortName = EdocsApi.getAttributeValue("OrgShortName").value;
  if (!orgCode || !orgShortName) {
    return;
  }
  var idnumber = EdocsApi.getAttributeValue("DocId");
  var methodData = {
    extSysDocId: idnumber.value,
    eventType: "CommentAdded",
    comment: caseTaskComment.comment,
    partyCode: orgCode,
    userTitle: CurrentUser.name,
    partyName: orgShortName,
    occuredAt: new Date(),
  };

  caseTaskComment.externalAPIExecutingParams = {
    externalSystemCode: "ESIGN1", // код зовнішньої системи
    externalSystemMethod: "integration/processEvent", // метод зовнішньої системи
    data: methodData, // дані, що очікує зовнішня система для заданого методу
    executeAsync: true, // виконувати завдання асинхронно
  };
}

//Скрипт 3. Автоматичне визначення email ініціатора рахунку та підрозділу
function onCreate() {
  EdocsApi.setAttributeValue({
    code: "OrgRPEmail",
    value: EdocsApi.getEmployeeDataByEmployeeID(CurrentDocument.initiatorId)
      .email,
    text: null,
  });
  EdocsApi.setAttributeValue({
    code: "Branch",
    value: EdocsApi.getOrgUnitDataByUnitID(
      EdocsApi.getEmployeeDataByEmployeeID(CurrentDocument.initiatorId).unitId,
      1
    ).unitId,
    text: null,
  });
}

function onSearchBranch(searchRequest) {
  searchRequest.filterCollection.push({
    attributeCode: "SubdivisionLevelDirect",
    value: "1",
  });
}

//Скрипт 4. Зміна властивостей атрибутів
function EnterInformationTask() {
  var stateTask = EdocsApi.getCaseTaskDataByCode(
    "EnterInformation" + EdocsApi.getAttributeValue("Sections").value
  )?.state;
  if (
    stateTask == "assigned" ||
    stateTask == "inProgress" ||
    stateTask == "delegated"
  ) {
    setPropertyRequired("StatusInvoice");
    setPropertyHidden("StatusInvoice", false);
    setPropertyDisabled("StatusInvoice", false);
  } else if (stateTask == "completed") {
    setPropertyRequired("StatusInvoice");
    setPropertyHidden("StatusInvoice", false);
    setPropertyDisabled("StatusInvoice");
  } else {
    setPropertyRequired("StatusInvoice", false);
    setPropertyHidden("StatusInvoice");
    setPropertyDisabled("StatusInvoice", false);
  }
}
function onCardInitialize() {
  debugger;
  EnterInformationTask();
}

function onBeforeCardSave() {
  onChangeBranch();
  setSections();
}
// Скрипт 5. Визначення ролі за розрізом
function setSections() {
  debugger;
  var Branch = EdocsApi.getAttributeValue("Branch");
  if (Branch.value) {
    var Sections = EdocsApi.getAttributeValue("Sections");
    var BranchData = EdocsApi.getOrgUnitDataByUnitID(Branch.value);
    if (Sections.value != BranchData.unitName) {
      Sections.value = BranchData.unitName;
      EdocsApi.setAttributeValue(Sections);
    }
  }
}

function onChangeBranch() {
  setSections();
}
