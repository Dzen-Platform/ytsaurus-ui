import React, {Component, useState, useRef, useEffect} from 'react';
import {connect, useSelector} from 'react-redux';
import PropTypes from 'prop-types';
import cn from 'bem-cn-lite';

import {showEditPoolsWeightsModal} from '../../../../../../store/actions/operations';

import {useRumMeasureStop} from '../../../../../../rum/RumUiContext';
import {RumMeasureTypes} from '../../../../../../rum/rum-measure-types';
import {isFinalLoadingStatus} from '../../../../../../utils/utils';
import {
    getOperationAlertEventsItems,
    getOperationDetailsLoadingStatus,
} from '../../../../../../store/selectors/operations/operation';
import {useAppRumMeasureStart} from '../../../../../../rum/rum-app-measures';

import {getUISizes} from '../../../../../../store/selectors/global';

import {operationProps, runtimeProps, eventsProps, resourcesProps, intermediateResourcesProps, } from '../../details/Runtime/Runtime';

import {specificationProps} from '../../details/Specification/Specification';

import { Button, Icon, Label, Link } from '@gravity-ui/uikit';
import { ArrowRotateLeft, ArrowUpRightFromSquare } from '@gravity-ui/icons';


import './SparkUi.scss';

const block = cn('spark-ui');


const SparkUi = ({ operation, showEditPoolsWeightsModal, cluster }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isIframeVisible, setIsIframeVisible] = useState(false);
    const [sparkUiState, setSparkUiState] = useState("UNKNOWN");
    const iframeRef = useRef(null);

    const fetchSparkUiState = async () => {
        try {
            const response = await fetch(`/api/spark-ui/${cluster}/${operation.id}/health`);
            const data = await response.json();
            if (sparkUiState != "ONLINE" && data.state == "ONLINE") {
                setIsIframeVisible(true);
            }
            setSparkUiState(data.state);
        } catch (error) {
            console.error('Error fetching Spark UI state:', error);
            setSparkUiState("UNKNOWN");
        }
    };


    const refresh = () => {
        setSparkUiState("UNKNOWN");
        setIsLoading(true);
        fetchSparkUiState();
        iframeRef.current?.contentWindow.location.reload();
    };


    useEffect(() => {

        
        const intervalId = setInterval(() => {
            fetchSparkUiState();
        }, 10000); // Fetch every 10 seconds

        fetchSparkUiState();
        
        return () => {
            clearInterval(intervalId);
        };
    }, []);

    const renderDescription = () => {
        const { description } = operation;
        return JSON.stringify(description);
    };

    const webUiAddr = operation.description["Web UI"];
    const src = `/api/spark-ui/${cluster}/${operation.id}/gateway/`;


    const mapStateToTheme = (state) => {
        if (state == "ONLINE") {
            return "success";
        }
        if (state == "OFFLINE") {
            return "danger";
        }
        return "warning"
    }

    return (
        <div className={block()}>
            <div className={block('toolbar')}>
                <div className={block('toolbar-labels')}>
                    <Label theme={mapStateToTheme(sparkUiState)} size='m'>
                        Spark UI: {sparkUiState}
                    </Label>
                </div>
                <div>
                    <Button onClick={refresh} loading={isLoading} title='Refresh'>
                        <Icon data={ArrowRotateLeft} size={16} />
                    </Button>
                    {"  "}
                    <Button href={src} target='_blank' title="Open in new window">
                        <Icon data={ArrowUpRightFromSquare} size={16} />
                    </Button>
                </div>
            </div>
            <iframe style={{ display: isIframeVisible ? 'block' : 'none' }} ref={iframeRef} src={src} className={block('iframe')} onLoad={() => {
                setIsLoading(false);
            }} onError={() => {
                setIsLoading(false);
            }} onAbort={() => {
                setIsLoading(false);
            }}></iframe>
        </div>
    );
};

SparkUi.propTypes = {
    operation: operationProps.isRequired,
    showEditPoolsWeightsModal: PropTypes.func.isRequired,
};


const mapStateToProps = (state) => {
    const {operations, global} = state;

    const {cluster} = global;
    const {operation} = operations.detail;

    return {
        cluster,
        operation,
        ...operations.detail.details,
        collapsibleSize: getUISizes().collapsibleSize,
        alertEvents: getOperationAlertEventsItems(state),
    };
};

const mapDispatchToProps = {
    showEditPoolsWeightsModal,
};

const DetailsConnected = connect(mapStateToProps, mapDispatchToProps)(SparkUi);

export default function DetailsWithRum() {
    const loadState = useSelector(getOperationDetailsLoadingStatus);

    useAppRumMeasureStart({
        type: RumMeasureTypes.OPERATION_TAB_DETAILS,
        additionalStartType: RumMeasureTypes.OPERATION,
        startDeps: [loadState],
        allowStart: ([loadState]) => {
            return !isFinalLoadingStatus(loadState);
        },
    });

    useRumMeasureStop({
        type: RumMeasureTypes.OPERATION_TAB_DETAILS,
        stopDeps: [loadState],
        allowStop: ([loadState]) => {
            return isFinalLoadingStatus(loadState);
        },
    });

    return <DetailsConnected />;
}
